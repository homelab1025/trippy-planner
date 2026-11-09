package com.trippyplanner.auth.application;

import java.util.Optional;

public interface UserRepository {

    long findOrCreate(String email);

    Optional<String> findEmailById(long userId);
}
