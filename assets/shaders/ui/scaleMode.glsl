    vec2 size = u_size;
    if ((u_scaleMode == SCALE_MODE_HEIGHT) || ((u_scaleMode == SCALE_MODE_MINIMUM) && (u_aspect >= 1.0)) || ((u_scaleMode == SCALE_MODE_MAXIMUM) && (u_aspect < 1.0))) {
        size.x /= u_aspect;
    }
    if ((u_scaleMode == SCALE_MODE_WIDTH) || ((u_scaleMode == SCALE_MODE_MINIMUM) && (u_aspect < 1.0)) || ((u_scaleMode == SCALE_MODE_MAXIMUM) && (u_aspect >= 1.0))) {
        size.y *= u_aspect;
    }