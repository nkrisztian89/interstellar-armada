#version 100

uniform mat4 u_cameraOrientationMatrix;
uniform mat4 u_projMatrix;

uniform mediump float u_billboardSize;
uniform mediump float u_relAge;

attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

uniform vec3 u_position;
	
varying mediump vec2 v_texCoord;

void main() {
	gl_Position = u_cameraOrientationMatrix * vec4(u_position, 1.0);
	gl_Position.xy+=a_position.xy*u_billboardSize*(1.0-u_relAge);
	gl_Position = u_projMatrix * gl_Position;
        gl_Position.z = gl_Position.w;
	
	v_texCoord = a_texCoord;
}
