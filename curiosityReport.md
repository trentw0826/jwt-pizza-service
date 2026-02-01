# Curiosity Report: Local Github Actions

## Introduction

As we implemented more functionality into our CI pipeline during deliverable #3, I found myself frustrated with the associated debugging process. When a deployment worked locally but failed remotely, I'd have to open up Github, navigate to the proper section in Actions, decide where the deployment broke, add logging statements, re-deploy, wait for Actions to build a new environment, watch it break again, realize I needed logging statements elsewhere, etc. until finally fixing the issue. I figured there must be tools that enabled a much quicker and easier workflow than the ones I was using.

![Failed CI pipeline, again](./images/filed-pipline.png)

My initial idea was to bundle up my whole project in a reproducible docker container. While this is certainly best practice long-term, I received feedback that it wasn't very realistic at such early stages of such a small project. I then discovered 'Act' by Nektos, a solution for running Github actions locally.

## Exploring 'Act'

After having trouble installing Act's CLI agent, I found out that the service is offered through a VS Code extension

## Usage tips

- Act supports simulated github events, including the `push` and `workflow_dispatch` that JWT pizza supports by default
- You may experience conflicts if running MySQL locally as Docker tries to expose MySQL locally on port 3306
- Secrets are not pulled in remotely (though their names are). This caused me a lot of headache until I realized I just needed to create a local .secrets file

## Credits

- [Nektos on Github](https://github.com/nektos)
- [Act's repository on Github](https://github.com/nektos/act)
- [Act docs](https://sanjulaganepola.github.io/github-local-actions-docs/)
