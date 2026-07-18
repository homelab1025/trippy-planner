package com.trippyplanner.auth;

public interface EmailService {
    void sendMagicLink(String email, String token);
}
