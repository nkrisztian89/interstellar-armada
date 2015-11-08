#version 100

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

uniform vec3 u_shift;
uniform float u_farthestZ;

attribute vec3 a_position;

varying vec3 v_position;
varying float v_dist;

void main() {
    gl_Position = u_cameraMatrix * u_modelMatrix * vec4(0.0,0.0,0.0,1.0);
    gl_Position.xyz += a_position.x * (u_shift / 200.0);
    v_dist = max(-gl_Position.z/u_farthestZ,0.0);
    gl_Position = u_projMatrix * gl_Position;
    v_position = a_position;
}
