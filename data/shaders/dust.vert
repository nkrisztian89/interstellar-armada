#version 100

precision mediump float;

#define DUST_LENGTH_DIVISOR 200.0

// scene uniforms
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

// common uniforms
uniform vec3 u_shift;
uniform float u_farthestZ;

// vertex attributes
attribute vec3 a_position;

// instance uniforms
uniform vec3 u_position;

varying vec3 v_position;
varying float v_dist;

void main() {
    gl_Position = u_cameraMatrix * vec4(u_position, 1.0);
    gl_Position.xyz += a_position.x * (u_shift / DUST_LENGTH_DIVISOR);
    v_dist = max(-gl_Position.z / u_farthestZ, 0.0);
    gl_Position = u_projMatrix * gl_Position;
    v_position = a_position;
}
