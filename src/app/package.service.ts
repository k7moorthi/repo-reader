import { Injectable }     from '@angular/core';
import { Http, Response } from '@angular/http';

import { Observable }     from 'rxjs/Observable';

import 'rxjs/add/observable/of';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

import { Package }        from './package';

@Injectable()
export class PackageService {
  private baseUrl = 'https://registry.npmjs.org';
  private corsAnywhereUrl = 'https://cors-anywhere.herokuapp.com/';
  private npmPkgUrl = 'https://www.npmjs.com/package/';

  constructor(private http: Http) {}

  searchByKeyword(keyword:string): Observable<Package[]> {
    return this.http
            .get(`${this.baseUrl}/-/v1/search?text=${keyword}`)
            .map(this.mapPackages.bind(this));
  }

  searchByAuthor(author:string): Observable<Package[]> {
    return this.http
            .get(`${this.baseUrl}/-/v1/search?text=author:${author}`)
            .map(this.mapPackages.bind(this));
  }

  getPackage(name:string): Promise<Package> {
    return this.http
            .get(`${this.corsAnywhereUrl}${this.baseUrl}/${name}`)
            .toPromise()
            .then(this.mapPackage.bind(this))
            .catch(this.handleError);
  }

  getAllPackages(): Observable<Package[]> {
    return this.http
            .get(`${this.baseUrl}/-/v1/search?text=boost-exact:true&size=18`)
            .map(this.mapPackages.bind(this));
  }

  getPopularPackages(): Observable<Package[]> {
    return this.http
            .get(`${this.baseUrl}/-/v1/search?quality=0.0&maintenance=0.0&popularity=1.0&text=boost-exact:true&size=18`)
            .map(this.mapPackages.bind(this));
  }

  getTotalPackagesCount(): Promise<number> {
    return this.http
            .get(`${this.corsAnywhereUrl}${this.baseUrl}/`)
            .toPromise()
            .then(this.countPackages.bind(this))
            .catch(this.handleError);
  }

  private countPackages(response: Response): number {
    let res = response.json();

    return (res.doc_count - res.doc_del_count);
  }

  private mapPackage(response:Response, packageName:string): Package {
    let res = response.json();

    let dependencyList = [];

    for (let dependency in res.versions[res['dist-tags'].latest].dependencies) {
      dependencyList.push(dependency);
    }

    let pkg = <Package>({
      name: res.name,
      version: res['dist-tags'].latest,
      desc: res.description,
      authorUsername: res.versions[res['dist-tags'].latest]._npmUser.name,
      authorEmail: res.versions[res['dist-tags'].latest]._npmUser.email,
      authorName: res.author.name ? res.author.name : '',
      keywords: res.keywords,
      homepage: res.homepage ? res.homepage : '',
      repoType: res.repository.type ? res.repository.type : '',
      repoUrl: res.repository.url ? this.sanitizeUrl(res.repository.url) : '',
      npmUrl: this.npmPkgUrl + res.name,
      publishDate: res.time.created,
      prettyPublishDate: this.prettyDate(res.time.created),
      lastModifiedTime: res.time.modified,
      prettyLastModifiedTime: this.prettyDate(res.time.modified),
      authorWebsite: res.author.url ? res.author.url : '',
      downloadUrl: res.versions[res['dist-tags'].latest].dist.tarball,
      license: res.license ? res.license : '',
      readme: res.readme ? res.readme : '',
      dependencies: dependencyList
    });

    return pkg;
  }

  private mapPackages(response:Response): Observable<Package[]> {
    let responseObjects = response.json().objects;

    if (responseObjects.length > 0) {
      console.log('Results found!');

      return responseObjects.map(this.toPackage.bind(this));
    } else {
      console.info('No results found for the given keyword!');

      return Observable.of<Package[]>([]);
    }
  }

  private toPackage(obj:any): Package {
    let repoType = '';

    if (obj.package.links.repository) {
      if (this.isGithubUrl(obj.package.links.repository) === true) {
        repoType = 'git';
      }
    }

    let starRating = Math.round((obj.score.final * 10) / 2);
    let starImages = [];

    for (let i = 0; i < 5; ++i) {
      if (i < starRating) {
        starImages.push('img/icon-star-filled-20px.svg');
      } else {
        starImages.push('img/icon-star-blank-20px.svg');
      }
    }

    let pkg = <Package>({
      name: obj.package.name,
      version: obj.package.version,
      desc: obj.package.description,
      authorUsername: obj.package.publisher.username,
      authorEmail: obj.package.publisher.email,
      authorName: (obj.package.author && obj.package.author.name) ? obj.package.author.name : '',
      keywords: obj.package.keywords,
      homepage: obj.package.links.homepage ? obj.package.links.homepage : '',
      repoType: repoType,
      repoUrl: obj.package.links.repository ? this.sanitizeUrl(obj.package.links.repository) : '',
      npmUrl: obj.package.links.npm ? obj.package.links.npm : this.npmPkgUrl + obj.package.name,
      publishDate: obj.package.date,
      prettyPublishDate: this.prettyDate(obj.package.date),
      rating: obj.score.final,
      stars: starImages
    });

    return pkg;
  }

  private isGithubUrl(url:string): boolean {
    return url.slice(0, 'http://github.com'.length) === 'http://github.com' ||
           url.slice(0, 'https://github.com'.length) === 'https://github.com' ||
           url.slice(0, 'git://github.com'.length) === 'git://github.com';
  }

  private sanitizeUrl(url:string): string {
    if (url.slice(0, 'git+'.length) === 'git+') {
      return url.slice('git+'.length, url.length)
    }

    if (url.slice(0, 'git://'.length) === 'git://') {
      return 'http' + url.slice('git'.length, url.length)
    }

    return '';
  }

  private prettyDate(time:string): string {
    if (time.indexOf('.') !== -1) {
      time = time.slice(0, time.indexOf('.')) + 'Z'
    }

    var date1 = new Date((time || ''));
    var date2 = new Date();
    var second = 1000, minute = second*60, hour = minute*60, day = hour*24, week = day*7;
    var diff = Math.abs((<any> date2) - (<any> date1));
    var diffObj = {
        years         : Math.abs(date2.getFullYear() - date1.getFullYear()),
        months        : Math.abs((date2.getFullYear() * 12 + date2.getMonth()) - (date1.getFullYear() * 12 + date1.getMonth())),
        weeks         : Math.floor(diff / week),
        days          : Math.floor(diff / day),
        hours         : Math.floor(diff / hour),
        minutes       : Math.floor(diff / minute),
        seconds       : Math.floor(diff / second),
        milliseconds  : Math.floor(diff % 1000)
    };

    var diffStr = '';

    if (diffObj.years > 0) {
      if (diffObj.years === 1) {
        diffStr = 'a year ago';
      } else {
        diffStr = diffObj.years + ' years ago';
      }
    } else if (diffObj.months > 0) {
      if (diffObj.months === 1) {
        diffStr = 'a month ago';
      } else {
        diffStr = diffObj.months + ' months ago';
      }
    } else if (diffObj.weeks > 0) {
      if (diffObj.weeks === 1) {
        diffStr = 'a week ago';
      } else {
        diffStr = diffObj.weeks + ' weeks ago';
      }
    } else if (diffObj.days > 0) {
      if (diffObj.days === 1) {
        diffStr = 'a day ago';
      } else {
        diffStr = diffObj.days + ' days ago';
      }
    } else if (diffObj.hours > 0) {
      if (diffObj.hours === 1) {
        diffStr = 'a hour ago';
      } else {
        diffStr = diffObj.hours + ' hours ago';
      }
    } else if (diffObj.minutes > 0) {
      if (diffObj.minutes === 1) {
        diffStr = 'a minute ago';
      } else {
        diffStr = diffObj.minutes + ' minutes ago';
      }
    } else if (diffObj.seconds > 0) {
      if (diffObj.seconds === 1) {
        diffStr = 'a second ago';
      } else {
        diffStr = diffObj.seconds + ' seconds ago';
      }
    } else {
      if (diffObj.milliseconds >= 1) {
        diffStr = diffObj.milliseconds + ' milliseconds ago';
      } else if (diffObj.milliseconds === 1) {
        diffStr = 'a millisecond ago';
      } else {
        diffStr = 'just now';
      }
    }

    return diffStr;
  }

  private handleError(error:any): Promise<any> {
    console.error('An error occurred', error);

    return Promise.reject(error.message || error);
  }
}