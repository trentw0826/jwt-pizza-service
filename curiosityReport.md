# Curiosity Report: Local Github Actions

## Introduction
As we implemented more functionality into our CI pipeline during deliverable #3, I found myself frustrated with the associated debugging process. When a deployment worked locally but failed remotely, I'd have to open up Github, navigate to the proper section in Actions, decide where the deployment broke, add logging statements, re-deploy, wait for Actions to build a new environment, watch it break again, realize I needed logging statements elsewhere, etc. until finally fixing the issue. I figured there must be tools that enabled a much quicker and easier workflow than the ones I was using.

My initial idea was to bundle up my whole project in a reproducible docker container. While this is certainly best practice long-term, it wasn't very realistic at such early stages of such a small project. That's when I came across 'Act' by Nektos. 

## Overview

