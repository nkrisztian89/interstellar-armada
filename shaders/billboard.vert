#version 100

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

uniform vec3 u_eyePos;

attribute vec3 a_position;
attribute vec2 a_texCoord;
	
varying vec2 v_texCoord;

void main() {
	vec3 eyeToModel = (u_modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz - u_eyePos;
	vec4 vx = vec4(normalize(cross(eyeToModel,u_modelMatrix[1].xyz))*length(u_modelMatrix[0].xyz), u_modelMatrix[0].w);
	vec4 vy = u_modelMatrix[1];
	vec4 vz = vec4(normalize(cross(vx.xyz,vy.xyz))*length(u_modelMatrix[2].xyz), u_modelMatrix[2].w);
	vec4 vw = u_modelMatrix[3];
	
	mat4 mvpMatrix = u_projMatrix * u_cameraMatrix * mat4(vx,vy,vz,vw);
	
	gl_Position = mvpMatrix * vec4(a_position,1.0);	
	
	v_texCoord = a_texCoord;
}
