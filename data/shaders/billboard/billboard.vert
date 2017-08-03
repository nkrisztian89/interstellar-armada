#version 100

// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance uniforms
uniform vec3 u_position;
uniform vec3 u_direction;
uniform float u_size;

// varyings
varying mediump vec2 v_texCoord;

void main() {
	vec3 eyeToModel = u_position - u_eyePos;
	vec4 vx = vec4(normalize(cross(eyeToModel, u_direction)) * u_size, 0.0);
	vec4 vy = vec4(u_direction * u_size, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * u_size, 0.0);
	vec4 vw = vec4(u_position, 1.0);
	
	mat4 mvpMatrix = u_viewProjMatrix * mat4(vx, vy, vz, vw);
	
	gl_Position = mvpMatrix * vec4(a_position, 1.0);	
	
	v_texCoord = a_texCoord;
}
