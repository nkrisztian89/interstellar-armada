highp float near = (LISPSM_NEAR_FACTOR + range) * parallelism + LISPSM_MINIMUM_NEAR;
highp float far = 2.0 * range + near;

highp mat4 LiSPTM = mat4(
    far / range, 0.0,                             0.0,               0.0,
    0.0,         (far + near) / (far - near),     0.0,              -1.0,
    0.0,         0.0,                             far / depthRange,  0.0,
    0.0,         2.0 * far * near / (far - near), 0.0,               0.0);