#version 100

// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;

// instance attributes
attribute vec3 i_startPosition;
attribute vec3 i_endPosition;
attribute vec3 i_startDirection;
attribute vec3 i_endDirection;
attribute vec3 i_size;
attribute lowp vec4 i_color;

// varyings
varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;

void main() {
        float ratio = (a_position.y * 0.5) + 0.5;
	vec4 vx = vec4(normalize(cross(
            mix(i_startPosition, i_endPosition, ratio) - u_eyePos, 
            mix(i_startDirection, i_endDirection, ratio))) * i_size.x, 0.0);
	vec4 vy = vec4((i_endPosition - i_startPosition) * 0.5, 0.0);
	vec4 vz = vec4(normalize(cross(vx.xyz, vy.xyz)) * i_size.x, 0.0);
	vec4 vw = vec4((i_startPosition + i_endPosition) * 0.5, 1.0);

        mat4 mvpMatrix =  u_viewProjMatrix * mat4(vx, vy, vz, vw);
	
	gl_Position = mvpMatrix * vec4(a_position, 1.0);	
	
        v_texCoord = vec2((a_position.x * 0.5) + 0.5, 1.0 - mix(i_size.y, i_size.z, ratio));
        v_color = i_color;
}
