#version 100

// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance attributes
attribute vec4 i_position; // 4th coordinate marks the size
attribute vec4 i_direction; // 4th coordinate marks the opacity

// varyings
varying mediump vec2 v_texCoord;
varying lowp float v_opacity;

void main() {
	vec3 eyeToModel = i_position.xyz - u_eyePos;
	vec4 vx = vec4(normalize(cross(eyeToModel, i_direction.xyz)) * i_position.w, 0.0);
	vec4 vy = vec4(i_direction.xyz * i_position.w, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * i_position.w, 0.0);
	vec4 vw = vec4(i_position.xyz, 1.0);
	
	mat4 mvpMatrix = u_viewProjMatrix * mat4(vx, vy, vz, vw);
	
	gl_Position = mvpMatrix * vec4(a_position, 1.0);	
	
	v_texCoord = a_texCoord;
        v_opacity = i_direction.w;
}
