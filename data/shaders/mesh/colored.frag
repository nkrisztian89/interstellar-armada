// Simple shader using vertex attribute colors

precision mediump float;
	
varying vec4 v_color;

void main() {
    gl_FragColor = v_color;
}