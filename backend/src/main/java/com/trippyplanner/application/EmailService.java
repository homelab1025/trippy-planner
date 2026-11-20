package com.trippyplanner.application;

public interface EmailService {
    void sendMagicLink(String email, String token);
}
