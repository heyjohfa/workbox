/*
 Copyright 2016 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const rename = require('gulp-rename');
const insert = require('gulp-insert');
const handlebars = require('gulp-compile-handlebars');
const {globPromise, taskHarness} = require('../utils/build');

const FRONT_MATTER = `---
layout: index
title: Modules Overview
navigation_weight: 6
---

`;

const AUTO_GENERATED = '<!-- DO NOT EDIT. This page is autogenerated. -->\n';

const generateHandlebarsData = (projectPath) => {
  const projectMetadata = require(`${projectPath}/package.json`);

  const handleBarsData = {
    name: projectMetadata.name,
    description: projectMetadata.description,
    background: projectMetadata.background,
  };

  try {
    const demoStats = fs.statSync(path.join(projectPath, 'demo'));
    handleBarsData.hasDemo = demoStats.isDirectory();
  } catch(err) {
    handleBarsData.hasDemo = false;
  }

  handleBarsData.hasRefDocs = (projectMetadata.name !== 'sw-cli');

  // sw-cli needs a custom install command
  if (projectMetadata.name === 'sw-cli') {
    handleBarsData.installCmd = `npm install --global sw-cli`;
  }

  return handleBarsData;
};

/**
 * Documents a given project.
 * @param {String} projectPath The path to a project directory.
 * @return {Promise} Resolves if documenting succeeds, rejects if it fails.
 */
const documentPackage = (projectPath) => {
  return new Promise((resolve) => {
    const handleBarsData = generateHandlebarsData(projectPath);

    // First, use metadata require(package.json to write out an initial
    // README.md.
    gulp.src('templates/Project-README.hbs')
      .pipe(handlebars(handleBarsData))
      .pipe(rename('README.md'))
      .pipe(insert.prepend(AUTO_GENERATED))
      .pipe(gulp.dest(projectPath))
      .on('end', resolve);
  });
};

gulp.task('documentation:projects', () => {
  return taskHarness(documentPackage, global.projectOrStar);
});

gulp.task('documentation:repo', () => {
  if (global.projectOrStar !== '*') {
    throw Error('Please do not use --project= with documentation:repo.');
  }


  return new Promise((resolve) => {
    // First, generate a repo README.md based on metadata from each project.
    return globPromise('packages/*/package.json')
      .then((pkgs) => {
        return pkgs.map((pkg) => {
          const pkgPath = path.dirname(path.join(__dirname, '..', pkg));
          return generateHandlebarsData(pkgPath);
        });
      })
      .then((projectData) => {
        gulp.src('templates/README.hbs')
          .pipe(handlebars({projects: projectData}))
          .pipe(rename({extname: '.md'}))
          .pipe(insert.prepend(AUTO_GENERATED))
          .pipe(gulp.dest('.'))
          .on('end', resolve);
      });
  })
  .then(() => {
    return new Promise((resolve) => {
      gulp.src('./README.md')
        .pipe(rename({basename: 'modules_overview'}))
        .pipe(insert.prepend(FRONT_MATTER))
        .pipe(gulp.dest('./docs/'))
        .on('end', resolve);
    });
  });
});

gulp.task('documentation', ['documentation:repo', 'documentation:projects']);
