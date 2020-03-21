#version 100

// scene uniforms
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance uniforms
uniform vec3 u_position;
uniform float u_billboardSize;

// varyings
varying mediump vec2 v_texCoord;

void main() {
	gl_Position = u_cameraMatrix * vec4(u_position, 1.0);
	gl_Position.xy += a_position.xy * u_billboardSize;
	gl_Position = u_projMatrix * gl_Position;
	
	v_texCoord = a_texCoord;
}
