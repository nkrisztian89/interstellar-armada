#version 100

precision mediump float;

uniform vec2 u_viewportSize;

uniform vec2 u_position;
uniform vec2 u_size;
uniform mat2 u_rotationMatrix;

attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

varying mediump vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;
    gl_Position = vec4((u_position + (u_rotationMatrix * vec2(a_position.x, -a_position.y) * u_size)) / u_viewportSize, 0.0, 1.0);
    gl_Position.x = (gl_Position.x - 0.5) * 2.0;
    gl_Position.y = (0.5 - gl_Position.y) * 2.0;
}
