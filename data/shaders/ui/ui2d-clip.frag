#version 100

precision mediump float;

uniform vec4 u_color;
uniform sampler2D u_colorTexture;
uniform vec4 u_clipCoords;
uniform vec4 u_clipColor;

varying vec2 v_texCoord;

void main() {
    if ((v_texCoord.x < u_clipCoords.x) || (v_texCoord.x > u_clipCoords.y) || 
        (v_texCoord.y < u_clipCoords.z) || (v_texCoord.y > u_clipCoords.w)) {
        gl_FragColor = u_clipColor * texture2D(u_colorTexture, v_texCoord);
    } else {
        gl_FragColor = u_color * texture2D(u_colorTexture, v_texCoord);
    }
}
