#version 100

precision mediump float;
	
uniform lowp vec4 u_color;

varying vec4 v_worldPos;
	
void main() {
    gl_FragColor = u_color * (v_worldPos.z + 0.5);
}