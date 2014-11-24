// A shader that simply displays the color set in a uniform.

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

attribute vec3 a_position;

void main() {
    gl_Position = u_projMatrix * u_cameraMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
