# GitLab CI/CD — `.gitlab-ci.yml`

Provider-specific template for [setup-external-ci-cd](./SKILL.md). Complete the one-time setup (variables,
`post-code-deploy` hook) in `SKILL.md` first, then write this file at the repo root.

**Before writing:** substitute `<PHP_VERSION>` in the `image` with the app's actual PHP version
(see [Determine the PHP version](./SKILL.md#determine-the-php-version)) — do not hardcode it.

Approval gates are expressed with `when: manual`: `deploy-test` / `deploy-prod` appear in the pipeline but only
run when a team member starts them. Add the secrets as CI/CD **Variables** (Masked, and Protected if the branch
is protected), e.g. `glab variable set ACQUIA_CLI_KEY "<key>" --masked`.

```yaml
stages: [ci, build, deploy-dev, deploy-test, deploy-prod]
default:
  image: php:<PHP_VERSION>-cli
variables:
  DEPLOY_BRANCH: "pipelines-build-${CI_DEFAULT_BRANCH}"

.acli: &acli
  - curl -sSL https://github.com/acquia/cli/releases/latest/download/acli.phar -o /usr/local/bin/acli && chmod +x /usr/local/bin/acli
  - acli auth:login --key="$ACQUIA_CLI_KEY" --secret="$ACQUIA_CLI_SECRET" --no-interaction

ci:
  stage: ci
  script:
    - composer validate --strict --no-interaction
    - composer install --prefer-dist --no-interaction --no-progress
    - composer audit --no-interaction
    - vendor/bin/phpcs --standard=phpcs.xml.dist docroot/modules/custom docroot/themes/custom
    - vendor/bin/phpstan analyse --configuration=phpstan.neon.dist --no-progress
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

build-push:
  stage: build
  script:
    - eval $(ssh-agent -s); echo "$ACQUIA_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh && ssh-keyscan -H "$(echo "$ACQUIA_GIT_URL" | sed 's/.*@//; s/:.*//')" >> ~/.ssh/known_hosts
    - *acli
    - RELEASE_TAG="build-${CI_PIPELINE_ID}"
    - acli push:artifact "$ACQUIA_DEV_ENV_ID" --destination-git-branch="$DEPLOY_BRANCH" --destination-git-tag="$RELEASE_TAG" --no-interaction
    - echo "RELEASE_TAG=${RELEASE_TAG}" >> build.env
  artifacts:
    reports:
      dotenv: build.env
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

# Reference is POSITIONAL, never --branch=. --task-wait blocks until the deploy finishes.
.deploy: &deploy
  script:
    - *acli
    - acli api:environments:code-switch "$TARGET_ENV_ID" "tags/${RELEASE_TAG}" --task-wait --no-interaction

deploy-dev:
  <<: *deploy
  stage: deploy-dev
  variables: { TARGET_ENV_ID: "$ACQUIA_DEV_ENV_ID" }
  environment: { name: acquia-dev }
  needs: [build-push]

deploy-test:
  <<: *deploy
  stage: deploy-test
  variables: { TARGET_ENV_ID: "$ACQUIA_TEST_ENV_ID" }
  environment: { name: acquia-test }
  needs: [build-push, deploy-dev]
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      when: manual

deploy-prod:
  <<: *deploy
  stage: deploy-prod
  variables: { TARGET_ENV_ID: "$ACQUIA_PROD_ENV_ID" }
  environment: { name: acquia-prod }
  needs: [build-push, deploy-test]
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      when: manual
```
