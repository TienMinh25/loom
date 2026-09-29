package iconpack

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func samplePNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x * 8), G: uint8(y * 8), B: 90, A: 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatal(err)
	}
	return encoded.Bytes()
}

func TestBuildICOContainsPngEncodedWindowsIconFrames(t *testing.T) {
	icon, err := BuildICO(bytes.NewReader(samplePNG(t)))
	if err != nil {
		t.Fatal(err)
	}
	if binary.LittleEndian.Uint16(icon[2:4]) != 1 || binary.LittleEndian.Uint16(icon[4:6]) != 7 {
		t.Fatalf("invalid ICO directory: %v", icon[:6])
	}
	if icon[6] != 16 || icon[22] != 24 || icon[102] != 0 {
		t.Fatalf("expected 16, 24 and 256 pixel frames, got widths %d, %d, %d", icon[6], icon[22], icon[102])
	}
}

func TestBuildICNSContainsMacIconFramesAndValidLength(t *testing.T) {
	icon, err := BuildICNS(bytes.NewReader(samplePNG(t)))
	if err != nil {
		t.Fatal(err)
	}
	if string(icon[:4]) != "icns" || int(binary.BigEndian.Uint32(icon[4:8])) != len(icon) {
		t.Fatalf("invalid ICNS header: %q, length %d, data %d", icon[:4], binary.BigEndian.Uint32(icon[4:8]), len(icon))
	}
	if !bytes.Contains(icon, []byte("ic10")) {
		t.Fatal("ICNS must contain a 1024-pixel macOS icon frame")
	}
}
