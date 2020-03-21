#version 100

precision mediump float;

#include "mesh/variables/model-tex-frag.glsl"

void main() {
    gl_FragColor = v_color * texture2D(u_diffuseTexture, v_texCoord);
}