#version 100

precision mediump float;

uniform vec4 u_color;
uniform sampler2D u_colorTexture;

varying mediump vec2 v_texCoord;

void main() {
    gl_FragColor = u_color * texture2D(u_colorTexture, v_texCoord);
}
