# Curiosity Report: Local Github Actions

## Why I Was Curious About Local Actions

As we implemented more functionality into our CI pipeline during deliverable #3, I found myself frustrated with the associated debugging process. When a deployment worked locally but failed remotely, I'd have to open up Github, navigate to the proper section in Actions, decide where the deployment broke, add logging statements, re-deploy, wait for Actions to build a new environment, watch it break again, realize I needed logging statements elsewhere, etc. until finally fixing the issue. I figured there must be tools that enabled a much quicker and easier workflow than the ones I was using.

![Failed CI pipeline, again](./images/failed-pipeline.png)

My initial idea was to bundle up my whole project in a reproducible docker container. While this is certainly best practice long-term, I received feedback that it wasn't very realistic at such early stages of such a small project. I then discovered 'Act' by Nektos, a solution for running Github actions locally.

## Exploring 'Act'

After having trouble installing Act's CLI agent, I found out that the service is offered through a VS Code extension. From what I understand, Act looks your repository’s .github/workflows directory to detect valid workflow files and allows you to run them locally inside Docker containers. These containers closely mirror GitHub’s remote environments for the sake of reproducibility. When a workflow is triggered, Act spins containers for each job, mounts your local repository into the container, starts a simulated GitHub event, and executes each step exactly as GitHub Actions would.

![Working local CI pipeline](./images/local-CI-pipeline-working.gif)

I found that some of the most useful features are

- The ability to manually select which workflow and job to run
- Direct simulation of Github events (like the `push` vs `workflow_dispatch` events used for JWT Pizza)
- Terminal outputs for debugging
- The ability to inspect container state mid-run (for debugging environment variables, for example)

## Usage Tips From Personal Experience

- You may experience conflicts if running MySQL locally as Docker tries to expose MySQL locally on port 3306. You can temporarily turn pause mysql, or use a different port.
- Secrets are not pulled in remotely (though their names are). This caused me a lot of headache.

## Credits

- [Nektos on Github](https://github.com/nektos)
- [Act's repository on Github](https://github.com/nektos/act)
- [Act docs](https://sanjulaganepola.github.io/github-local-actions-docs/)
