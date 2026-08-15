package com.trippyplanner.version;

import com.trippyplanner.api.VersionApi;
import com.trippyplanner.model.VersionInfo;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@RestController
public class VersionController implements VersionApi {

    private final BuildProperties buildProperties;

    public VersionController(BuildProperties buildProperties) {
        this.buildProperties = buildProperties;
    }

    @Override
    public ResponseEntity<VersionInfo> getVersion() {
        VersionInfo info = new VersionInfo();
        info.setVersion(buildProperties.getVersion());
        info.setBuildTime(OffsetDateTime.ofInstant(buildProperties.getTime(), ZoneOffset.UTC));
        return ResponseEntity.ok(info);
    }
}
