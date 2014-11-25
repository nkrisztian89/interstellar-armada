// Lambert shading with one light source.

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;
uniform mat3 u_normalMatrix;

attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec3 a_normal;
attribute vec4 a_color;

varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;

void main() {
    gl_Position = u_projMatrix * u_cameraMatrix * u_modelMatrix * vec4(a_position, 1.0);
    v_texCoord = a_texCoord;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_color = a_color;
}
