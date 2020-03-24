#version 100

// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;

// instance uniforms
uniform vec3 u_startPosition;
uniform vec3 u_endPosition;
uniform vec3 u_startDirection;
uniform vec3 u_endDirection;
uniform vec3 u_size;

// varyings
varying mediump vec2 v_texCoord;

void main() {
        float ratio = (a_position.y * 0.5) + 0.5;
	vec4 vx = vec4(normalize(cross(
            mix(u_startPosition, u_endPosition, ratio) - u_eyePos, 
            mix(u_startDirection, u_endDirection, ratio))) * u_size.x, 0.0);
	vec4 vy = vec4((u_endPosition - u_startPosition) * 0.5, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * u_size.x, 0.0);
	vec4 vw = vec4((u_startPosition + u_endPosition) * 0.5, 1.0);

        mat4 mvpMatrix =  u_viewProjMatrix * mat4(vx, vy, vz, vw);
	
	gl_Position = mvpMatrix * vec4(a_position, 1.0);

        v_texCoord = vec2((a_position.x * 0.5) + 0.5, mix(u_size.y, u_size.z, ratio));
}
