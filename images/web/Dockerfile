ARG WEB_BASE_IMAGE
FROM ${WEB_BASE_IMAGE}


ARG WEB_BASE_IMAGE
ARG WEB_BASE_REVISION
ARG WEB_OVERLAY_SHA256
COPY Dockerfile aws-config apply-object-storage-overlay.cjs /opt/uptomic-web-overlay/
RUN WEB_BASE_IMAGE="$WEB_BASE_IMAGE" \
    WEB_BASE_REVISION="$WEB_BASE_REVISION" \
    WEB_OVERLAY_SHA256="$WEB_OVERLAY_SHA256" \
    node /opt/uptomic-web-overlay/apply-object-storage-overlay.cjs \
      /code/posthog/storage/object_storage.py

ENV AWS_CONFIG_FILE=/opt/uptomic-web-overlay/aws-config
