#define ORIGINAL_COLOR_RATIO 0.25
#define ANAGLYPH_GAMMA 1.6
#define ANAGLYPH_CYAN_FACTOR 0.3

precision mediump float;

uniform sampler2D u_stereoTexture;

varying vec2 v_texCoords;

void main() {
    vec4 color = texture2D(u_stereoTexture,v_texCoords);
    float luminance = pow(ANAGLYPH_CYAN_FACTOR * (0.299 * color.r + 0.587 * color.g + 0.114 * color.b), 1.0/ANAGLYPH_GAMMA); 
    // luminance multiplied by ANAGLYPH_CYAN_FACTOR to compensate for cyan appearing brighter to the human eye
    gl_FragColor = vec4(0.0, 
                        mix(luminance, color.g, ORIGINAL_COLOR_RATIO),
                        mix(luminance, color.b, ORIGINAL_COLOR_RATIO),
                        color.a);
}
