#version 100

// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance attributes
attribute vec4 i_position; // 4th coordinate marks the size
attribute vec3 i_direction;
attribute lowp vec4 i_color;

// varyings
varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;

void main() {
	vec3 eyeToModel = i_position.xyz - u_eyePos;
	vec4 vx = vec4(normalize(cross(eyeToModel, i_direction)) * i_position.w, 0.0);
	vec4 vy = vec4(i_direction * i_position.w, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * i_position.w, 0.0);
	vec4 vw = vec4(i_position.xyz, 1.0);
	
	mat4 mvpMatrix = u_viewProjMatrix * mat4(vx, vy, vz, vw);
	
	gl_Position = mvpMatrix * vec4(a_position, 1.0);	
	
	v_texCoord = a_texCoord;
        v_color = i_color;
}
