float ifEqualInt(int x, int y) {
    return 1.0 - abs(sign(float(x - y)));
}

float ifEqual(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float ifGreater(float x, float y) {
    return max(sign(x - y), 0.0);
}

float ifGreaterEqual(float x, float y) {
    return step(y, x);
}