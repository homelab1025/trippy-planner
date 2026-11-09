package com.trippyplanner.auth.application;

public interface EmailService {
    void sendMagicLink(String email, String token);
}
