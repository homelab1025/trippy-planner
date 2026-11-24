package com.trippyplanner.domain.model;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A saved route's metadata. The GPX track is deliberately not part of it: it is immutable after creation, large,
 * and only ever needed for one route at a time, so it travels separately through the application layer.
 * {@code checkpointsJson} is opaque to the backend and may be null; {@code shareToken} is null while private.
 */
public record Route(
        UUID id,
        long ownerId,
        String name,
        double avgSpeedKmh,
        OffsetDateTime startTime,
        String checkpointsJson,
        String shareToken,
        OffsetDateTime createdAt) {

    public Route {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(startTime, "startTime");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    public static Builder builder() {
        return new Builder();
    }

    public boolean isPublic() {
        return shareToken != null;
    }

    public boolean isOwnedBy(long userId) {
        return ownerId == userId;
    }

    /**
     * Keeps an existing token, so sharing an already-shared route doesn't invalidate links already handed out.
     */
    public Route share(String token) {
        Objects.requireNonNull(token, "token");
        return isPublic() ? this : withShareToken(token);
    }

    public Route unshare() {
        return withShareToken(null);
    }

    public Route withName(String newName) {
        return new Route(id, ownerId, newName, avgSpeedKmh, startTime, checkpointsJson, shareToken, createdAt);
    }

    public Route withAvgSpeedKmh(double newAvgSpeedKmh) {
        return new Route(id, ownerId, name, newAvgSpeedKmh, startTime, checkpointsJson, shareToken, createdAt);
    }

    public Route withStartTime(OffsetDateTime newStartTime) {
        return new Route(id, ownerId, name, avgSpeedKmh, newStartTime, checkpointsJson, shareToken, createdAt);
    }

    public Route withCheckpointsJson(String newCheckpointsJson) {
        return new Route(id, ownerId, name, avgSpeedKmh, startTime, newCheckpointsJson, shareToken, createdAt);
    }

    /**
     * True if {@code other} is the same route with only user-editable fields changed.
     */
    public boolean hasSameIdentityAs(Route other) {
        return id.equals(other.id) && ownerId == other.ownerId && createdAt.equals(other.createdAt)
            && Objects.equals(shareToken, other.shareToken);
    }

    private Route withShareToken(String newShareToken) {
        return new Route(id, ownerId, name, avgSpeedKmh, startTime, checkpointsJson, newShareToken, createdAt);
    }

    public static final class Builder {
        private UUID id;
        private long ownerId;
        private String name;
        private double avgSpeedKmh;
        private OffsetDateTime startTime;
        private String checkpointsJson;
        private String shareToken;
        private OffsetDateTime createdAt;

        private Builder() {
        }

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder ownerId(long ownerId) {
            this.ownerId = ownerId;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder avgSpeedKmh(double avgSpeedKmh) {
            this.avgSpeedKmh = avgSpeedKmh;
            return this;
        }

        public Builder startTime(OffsetDateTime startTime) {
            this.startTime = startTime;
            return this;
        }

        public Builder checkpointsJson(String checkpointsJson) {
            this.checkpointsJson = checkpointsJson;
            return this;
        }

        public Builder shareToken(String shareToken) {
            this.shareToken = shareToken;
            return this;
        }

        public Builder createdAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Route build() {
            return new Route(id, ownerId, name, avgSpeedKmh, startTime, checkpointsJson, shareToken, createdAt);
        }
    }
}
