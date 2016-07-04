#version 100

// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance attributes
attribute vec3 i_position;
attribute vec3 i_direction;
attribute float i_size;
	
varying mediump vec2 v_texCoord;

void main() {
	vec3 eyeToModel = i_position - u_eyePos;
	vec4 vx = vec4(normalize(cross(eyeToModel, i_direction)) * i_size, 0.0);
	vec4 vy = vec4(i_direction * i_size, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * i_size, 0.0);
	vec4 vw = vec4(i_position, 1.0);
	
	mat4 mvpMatrix = u_viewProjMatrix * mat4(vx, vy, vz, vw);
	
	gl_Position = mvpMatrix * vec4(a_position, 1.0);	
	
	v_texCoord = a_texCoord;
}
