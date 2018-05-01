#define ORIGINAL_COLOR_RATIO 0.25
#define ANAGLYPH_GAMMA 1.6

precision mediump float;

uniform sampler2D u_stereoTexture;

varying vec2 v_texCoords;

void main() {
    vec4 color = texture2D(u_stereoTexture,v_texCoords);
    float luminance = pow(1.0 * (0.299 * color.r + 0.587 * color.g + 0.114 * color.b), 1.0/ANAGLYPH_GAMMA);
    gl_FragColor = vec4(mix(luminance, color.r, ORIGINAL_COLOR_RATIO), 0.0, 0.0, color.a);
}