package com.trippyplanner.auth.adapter.web;

import com.trippyplanner.api.AuthApi;
import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.auth.application.AuthService;
import com.trippyplanner.model.MagicLinkRequest;
import com.trippyplanner.model.User;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController implements AuthApi {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public ResponseEntity<Void> requestMagicLink(MagicLinkRequest body) {
        authService.requestMagicLink(body.getEmail());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<User> getMe(CurrentUser currentUser) {
        User user = new User();
        user.setId(currentUser.userId());
        user.setEmail(authService.findEmail(currentUser));
        return ResponseEntity.ok(user);
    }

    @Override
    public ResponseEntity<Void> deleteSession(CurrentUser currentUser) {
        authService.signOut(currentUser);
        return ResponseEntity.noContent().build();
    }
}
