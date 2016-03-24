#version 100

uniform mat4 u_cameraOrientationMatrix;
uniform mat4 u_projMatrix;

uniform float u_billboardSize;
uniform float u_relAge;

attribute vec3 a_position;
attribute vec2 a_texCoord;

uniform vec3 u_position;
	
varying vec2 v_texCoord;

void main() {
	gl_Position = u_cameraOrientationMatrix * vec4(u_position, 1.0);
	gl_Position.xy+=a_position.xy*u_billboardSize*(1.0-u_relAge);
	gl_Position = u_projMatrix * gl_Position;
	
	v_texCoord = a_texCoord;
}
