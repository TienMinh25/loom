package iconpack

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
)

var ErrInvalidImage = errors.New("icon source must be a non-empty PNG image")

func BuildICO(source io.Reader) ([]byte, error) {
	img, err := decode(source)
	if err != nil {
		return nil, err
	}
	sizes := []int{16, 24, 32, 48, 64, 128, 256}
	frames := make([][]byte, 0, len(sizes))
	for _, size := range sizes {
		frame, err := encodeFrame(img, size)
		if err != nil {
			return nil, err
		}
		frames = append(frames, frame)
	}

	const directorySize = 6
	const entrySize = 16
	icon := make([]byte, directorySize+entrySize*len(frames))
	binary.LittleEndian.PutUint16(icon[2:4], 1)
	binary.LittleEndian.PutUint16(icon[4:6], uint16(len(frames)))
	imageOffset := len(icon)
	for index, size := range sizes {
		entryOffset := directorySize + entrySize*index
		encodedSize := size
		if size == 256 {
			encodedSize = 0
		}
		icon[entryOffset] = byte(encodedSize)
		icon[entryOffset+1] = byte(encodedSize)
		binary.LittleEndian.PutUint16(icon[entryOffset+4:entryOffset+6], 1)
		binary.LittleEndian.PutUint16(icon[entryOffset+6:entryOffset+8], 32)
		binary.LittleEndian.PutUint32(icon[entryOffset+8:entryOffset+12], uint32(len(frames[index])))
		binary.LittleEndian.PutUint32(icon[entryOffset+12:entryOffset+16], uint32(imageOffset))
		icon = append(icon, frames[index]...)
		imageOffset += len(frames[index])
	}
	return icon, nil
}

func BuildICNS(source io.Reader) ([]byte, error) {
	img, err := decode(source)
	if err != nil {
		return nil, err
	}
	types := []struct {
		name string
		size int
	}{
		{name: "icp4", size: 16},
		{name: "icp5", size: 32},
		{name: "icp6", size: 64},
		{name: "ic07", size: 128},
		{name: "ic08", size: 256},
		{name: "ic09", size: 512},
		{name: "ic10", size: 1024},
	}
	frames := make([][]byte, 0, len(types))
	totalSize := 8
	for _, frameType := range types {
		frame, err := encodeFrame(img, frameType.size)
		if err != nil {
			return nil, err
		}
		frames = append(frames, frame)
		totalSize += 8 + len(frame)
	}
	icon := make([]byte, 8, totalSize)
	copy(icon[:4], "icns")
	binary.BigEndian.PutUint32(icon[4:8], uint32(totalSize))
	for index, frameType := range types {
		icon = append(icon, frameType.name...)
		length := make([]byte, 4)
		binary.BigEndian.PutUint32(length, uint32(8+len(frames[index])))
		icon = append(icon, length...)
		icon = append(icon, frames[index]...)
	}
	return icon, nil
}

func decode(source io.Reader) (image.Image, error) {
	img, err := png.Decode(source)
	if err != nil || img.Bounds().Empty() {
		return nil, ErrInvalidImage
	}
	return img, nil
}

func encodeFrame(source image.Image, size int) ([]byte, error) {
	resized := image.NewRGBA64(image.Rect(0, 0, size, size))
	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	crop := math.Min(float64(width), float64(height))
	for y := 0; y < size; y++ {
		sy := float64(bounds.Min.Y) + (float64(y)+0.5)*crop/float64(size) - 0.5
		for x := 0; x < size; x++ {
			sx := float64(bounds.Min.X) + (float64(x)+0.5)*crop/float64(size) - 0.5
			resized.Set(x, y, sampleBilinear(source, sx, sy))
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, resized); err != nil {
		return nil, err
	}
	return encoded.Bytes(), nil
}

func sampleBilinear(source image.Image, x, y float64) color.RGBA64 {
	bounds := source.Bounds()
	x0 := clamp(int(math.Floor(x)), bounds.Min.X, bounds.Max.X-1)
	y0 := clamp(int(math.Floor(y)), bounds.Min.Y, bounds.Max.Y-1)
	x1 := clamp(x0+1, bounds.Min.X, bounds.Max.X-1)
	y1 := clamp(y0+1, bounds.Min.Y, bounds.Max.Y-1)
	fx := x - math.Floor(x)
	fy := y - math.Floor(y)
	c00 := color.RGBAModel.Convert(source.At(x0, y0)).(color.RGBA)
	c10 := color.RGBAModel.Convert(source.At(x1, y0)).(color.RGBA)
	c01 := color.RGBAModel.Convert(source.At(x0, y1)).(color.RGBA)
	c11 := color.RGBAModel.Convert(source.At(x1, y1)).(color.RGBA)
	return color.RGBA64{
		R: uint16(interpolate(uint32(c00.R)*257, uint32(c10.R)*257, uint32(c01.R)*257, uint32(c11.R)*257, fx, fy)),
		G: uint16(interpolate(uint32(c00.G)*257, uint32(c10.G)*257, uint32(c01.G)*257, uint32(c11.G)*257, fx, fy)),
		B: uint16(interpolate(uint32(c00.B)*257, uint32(c10.B)*257, uint32(c01.B)*257, uint32(c11.B)*257, fx, fy)),
		A: uint16(interpolate(uint32(c00.A)*257, uint32(c10.A)*257, uint32(c01.A)*257, uint32(c11.A)*257, fx, fy)),
	}
}

func interpolate(topLeft, topRight, bottomLeft, bottomRight uint32, x, y float64) uint32 {
	top := float64(topLeft)*(1-x) + float64(topRight)*x
	bottom := float64(bottomLeft)*(1-x) + float64(bottomRight)*x
	return uint32(math.Round(top*(1-y) + bottom*y))
}

func clamp(value, minimum, maximum int) int {
	return max(minimum, min(value, maximum))
}
