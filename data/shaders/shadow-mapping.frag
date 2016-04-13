#version 100

precision mediump float;

varying float v_depth;

void main() {
    // using 255 instead of 256 because the latter results in incorrect unpacked values in a certain band as if a bit or two were lost
    vec2 packedDepth = clamp(v_depth, 0.0, 1.0) * vec2(255.0, 255.0);
    packedDepth.x = fract(packedDepth.x);
    packedDepth.y = floor(packedDepth.y) / 255.0;
    gl_FragColor = vec4(0.0, 0.0, packedDepth);
}