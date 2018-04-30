precision mediump float;

#define DEPTH_TEXTURES 0

uniform sampler2D u_shadowMapDebug;

varying vec2 v_texCoords;

void main() {
    // unpack
    vec4 texel = texture2D(u_shadowMapDebug, v_texCoords);
    #if !DEPTH_TEXTURES
    float texelDepth = dot(texel.ba, vec2(1.0 / 255.0, 1.0));
    #else
    float texelDepth = 1.0 - texel.r;
    #endif
    gl_FragColor = vec4(texelDepth, texelDepth, texelDepth, 1.0);
}