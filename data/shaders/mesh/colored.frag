#version 100

precision mediump float;
	
varying lowp vec4 v_color;

void main() {
    gl_FragColor = v_color;
}