# ── CI convergence role: GitHub Actions OIDC → one ssm:PutParameter (#703) ──
#
# Closes the loop from an image push to the fleet WITHOUT standing CI credentials.
# relay-image.yml, after it publishes, records the intended build into the
# `intended-image` SSM param; the always-running reconciler then converges the pool
# on its own schedule (pull-based). CI's ONLY AWS action is that single
# ssm:PutParameter, and it authenticates with a short-lived GitHub OIDC token —
# there is no long-lived access key anywhere in CI.
#
# Everything here is gated on var.github_repository: leave it empty and no CI role
# exists (the loop is then closed by the operator running the put-parameter by
# hand — see the README runbook). The role ARN is an OUTPUT; the owner adds it to
# the repo as a GitHub Actions VARIABLE (not a secret, never committed). No account
# id or ARN is written into the repo — they are constructed at apply time from the
# caller identity.

locals {
  ci_oidc_enabled  = var.github_repository != ""
  github_oidc_host = "token.actions.githubusercontent.com"
  github_oidc_arn  = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${local.github_oidc_host}"
}

# The account may hold only ONE OIDC provider for the GitHub URL. Create it only
# when the account has none yet (manage_github_oidc_provider = true); otherwise the
# trust policy just references the existing provider by its conventional ARN.
resource "aws_iam_openid_connect_provider" "github" {
  count = local.ci_oidc_enabled && var.manage_github_oidc_provider ? 1 : 0

  url             = "https://${local.github_oidc_host}"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]

  tags = { app = "pollis-relay" }
}

# Trust policy: only this repo's workflows, only on the trusted ref, only with the
# STS audience. That, plus the resource-scoped put below, is the whole blast radius.
data "aws_iam_policy_document" "ci_assume" {
  count = local.ci_oidc_enabled ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_host}:sub"
      values   = ["repo:${var.github_repository}:${var.github_oidc_ref}"]
    }
  }

  # A trust policy naming a provider ARN that does not exist yet fails to create;
  # when Terraform is creating the provider, order the role after it.
  depends_on = [aws_iam_openid_connect_provider.github]
}

resource "aws_iam_role" "ci_record_image" {
  count = local.ci_oidc_enabled ? 1 : 0

  name               = "${local.name_prefix}-ci-record-image"
  assume_role_policy = data.aws_iam_policy_document.ci_assume[0].json
  tags               = { app = "pollis-relay" }
}

# The role can write ONLY the intended-image param — not desired-state, not the
# placement draw, not any secret, and nothing outside this pool.
data "aws_iam_policy_document" "ci_record_image" {
  count = local.ci_oidc_enabled ? 1 : 0

  statement {
    sid       = "RecordIntendedImage"
    actions   = ["ssm:PutParameter"]
    resources = [local.intended_image_param_arn]
  }
}

resource "aws_iam_role_policy" "ci_record_image" {
  count = local.ci_oidc_enabled ? 1 : 0

  name   = "record-intended-image"
  role   = aws_iam_role.ci_record_image[0].id
  policy = data.aws_iam_policy_document.ci_record_image[0].json
}
