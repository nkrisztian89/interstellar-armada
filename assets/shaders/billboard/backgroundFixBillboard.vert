#version 100

uniform mat4 u_cameraOrientationMatrix;
uniform mat4 u_projMatrix;

uniform mat4 u_modelMatrix;

uniform mediump float u_billboardSize;

attribute vec3 a_position;
attribute mediump vec2 a_texCoord;
	
varying mediump vec2 v_texCoord;

void main() {
	gl_Position = u_cameraOrientationMatrix * u_modelMatrix * vec4(a_position * u_billboardSize, 1.0);
	gl_Position = u_projMatrix * gl_Position;
        gl_Position.z = gl_Position.w;
	
	v_texCoord = a_texCoord;
}
