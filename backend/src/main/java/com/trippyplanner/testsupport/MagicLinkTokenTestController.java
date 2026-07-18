package com.trippyplanner.testsupport;

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("e2e")
@RequestMapping("/test")
public class MagicLinkTokenTestController {

    private final InMemoryEmailService emailService;

    public MagicLinkTokenTestController(InMemoryEmailService emailService) {
        this.emailService = emailService;
    }

    @GetMapping("/magic-link-token")
    public ResponseEntity<MagicLinkTokenResponse> getMagicLinkToken(@RequestParam String email) {
        return emailService.findToken(email)
            .map(token -> ResponseEntity.ok(new MagicLinkTokenResponse(token)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public record MagicLinkTokenResponse(String token) {}
}
