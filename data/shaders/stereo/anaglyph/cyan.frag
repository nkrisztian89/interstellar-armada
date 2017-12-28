#define ORIGINAL_COLOR_RATIO 0.25
#define ANAGLYPH_GAMMA 1.6

precision mediump float;

uniform sampler2D u_stereoTexture;

varying vec2 v_texCoords;

void main() {
    vec4 color = texture2D(u_stereoTexture,v_texCoords);
    float luminance = pow(0.6 * (0.299 * color.r + 0.587 * color.g + 0.114 * color.b), 1.0/ANAGLYPH_GAMMA);
    gl_FragColor = vec4(0.0, 
                        (1.0 - ORIGINAL_COLOR_RATIO) * luminance + ORIGINAL_COLOR_RATIO * color.g,
                        (1.0 - ORIGINAL_COLOR_RATIO) * luminance + ORIGINAL_COLOR_RATIO * color.b,
                        color.a);
}
