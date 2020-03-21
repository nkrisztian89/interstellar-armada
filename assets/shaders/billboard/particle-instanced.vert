#version 100

// scene uniforms
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance attributes
attribute vec3 i_position;
attribute float i_billboardSize;
attribute lowp vec4 i_color;

// varyings
varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;

void main() {
	gl_Position = u_cameraMatrix * vec4(i_position, 1.0);
	gl_Position.xy += a_position.xy * i_billboardSize;
	gl_Position = u_projMatrix * gl_Position;
	
	v_texCoord = a_texCoord;
        v_color = i_color;
}
