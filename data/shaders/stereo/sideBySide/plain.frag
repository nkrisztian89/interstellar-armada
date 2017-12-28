precision mediump float;

uniform sampler2D u_stereoTexture;

varying vec2 v_texCoords;

void main() {
    gl_FragColor = texture2D(u_stereoTexture,v_texCoords);
}