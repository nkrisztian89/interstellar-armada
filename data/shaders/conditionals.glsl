float ifEqualInt(int x, int y) {
    return 1.0 - abs(sign(float(x - y)));
}

float ifEqual(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float ifEqual(vec4 x, vec4 y) {
    return 1.0 - min(1.0, dot(vec4(1.0,1.0,1.0,1.0), abs(sign(x - y))));
}

vec4 ifEqualAElseB(vec4 x, vec4 y, vec4 a, vec4 b) {
    return mix(b, a, ifEqual(x, y));
}

float ifGreater(float x, float y) {
    return max(sign(x - y), 0.0);
}

float ifGreaterEqual(float x, float y) {
    return step(y, x);
}