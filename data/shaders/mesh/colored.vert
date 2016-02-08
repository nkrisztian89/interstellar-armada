// Simple shader using vertex attribute colors

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

attribute vec3 a_position;
attribute vec4 a_color;

varying vec4 v_color;

void main() {
    gl_Position = u_projMatrix * u_cameraMatrix * u_modelMatrix * vec4(a_position, 1.0);
    v_color = a_color;
}
